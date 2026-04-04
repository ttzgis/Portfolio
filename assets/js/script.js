$( document ).ready(function() {
                function restartAnimation(selector, animationClass) {
                    $(selector).removeClass('animated slideInLeft slideInRight');
                    void $(selector)[0].offsetWidth;
                    $(selector).addClass('animated ' + animationClass);
                }
                
                $("#about_scroll").fadeOut();   
                $("#work_scroll").fadeOut();
                $("#contact_scroll").fadeOut();

                $("#about").click(function(){
                    $("#index").fadeOut();
                    $("#about_scroll").fadeIn();
                    restartAnimation('#about_left', 'slideInLeft');
                    restartAnimation('#about_right', 'slideInRight');
                    });
                $("#work").click(function(){
                    $("#index").fadeOut();
                    $("#work_scroll").fadeIn();
                    restartAnimation('#work_left', 'slideInLeft');
                    restartAnimation('#work_right', 'slideInRight');
                    });
                $("#contact").click(function(){
                    $("#index").fadeOut();
                    $("#contact_scroll").fadeIn();
                    restartAnimation('#contact_left', 'slideInLeft');
                    restartAnimation('#contact_right', 'slideInRight');
                    });
                
                $(".back").click(function(){
                    $(".pages").fadeOut();
                    $("#index").fadeIn();
                    restartAnimation('#index_left', 'slideInLeft');
                    restartAnimation('#index_right', 'slideInRight');
                    });
           
		});
